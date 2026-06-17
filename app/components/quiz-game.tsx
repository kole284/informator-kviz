"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type QuizOption = {
  oznaka: string;
  tekst: string;
};

type QuizQuestion = {
  id: number;
  kategorija: string;
  oblast: "Biologija" | "Hemija";
  pitanje: string;
  tip: string;
  opcije: QuizOption[];
  tacan_odgovor: string[];
};

type LoadStatus = "loading" | "ready" | "error";
type QuestionOrder = "random" | "sequential";

const QUESTION_FILE_GROUPS = {
  Biologija: [
    "/Pitanja/Biologija/biologija_razvica.json",
    "/Pitanja/Biologija/citologija.json",
    "/Pitanja/Biologija/ekologija.json",
    "/Pitanja/Biologija/embriologija.json",
    "/Pitanja/Biologija/evolucija.json",
    "/Pitanja/Biologija/fiziologija.json",
    "/Pitanja/Biologija/molekularna_biologija.json",
    "/Pitanja/Biologija/morfologija.json",
    "/Pitanja/Biologija/opsta_genetika.json",
    "/Pitanja/Biologija/sistematika.json",
  ],
  Hemija: [
    "/Pitanja/Hemija/opsta i neorganska hemija.json",
    "/Pitanja/Hemija/organska hemija.json",
  ],
} as const;

const SUBJECTS = ["Biologija", "Hemija"] as const;

type Subject = (typeof SUBJECTS)[number];

function isQuizOption(value: unknown): value is QuizOption {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const option = value as Partial<QuizOption>;

  return typeof option.oznaka === "string" && typeof option.tekst === "string";
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const question = value as Partial<QuizQuestion>;

  return (
    typeof question.id === "number" &&
    typeof question.kategorija === "string" &&
    question.kategorija.trim().length > 0 &&
    typeof question.pitanje === "string" &&
    typeof question.tip === "string" &&
    Array.isArray(question.opcije) &&
    question.opcije.every(isQuizOption) &&
    Array.isArray(question.tacan_odgovor) &&
    question.tacan_odgovor.every((answer) => typeof answer === "string")
  );
}

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function createRound(sourceQuestions: QuizQuestion[], order: QuestionOrder) {
  if (order === "sequential") {
    return [...sourceQuestions].sort((left, right) => left.id - right.id);
  }

  return shuffleArray(sourceQuestions);
}

function normalizeQuestionType(type: string) {
  return type.toLowerCase().replace(/[\s_-]+/g, "");
}

export function QuizGame() {
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [submittedAnswers, setSubmittedAnswers] = useState<string[] | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [questionOrder, setQuestionOrder] =
    useState<QuestionOrder>("random");

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        setStatus("loading");
        setErrorMessage("");

        const groupedPayloads = await Promise.all(
          SUBJECTS.map(async (subject) => {
            const files = QUESTION_FILE_GROUPS[subject];
            const payloads = await Promise.all(
              files.map(async (filePath) => {
                const response = await fetch(filePath);

                if (!response.ok) {
                  throw new Error(`Ne mogu da učitam pitanja iz fajla: ${filePath}`);
                }

                const data = (await response.json()) as unknown;

                if (!Array.isArray(data)) {
                  throw new Error(`Format pitanja nije ispravan za fajl: ${filePath}`);
                }

                return data;
              }),
            );

            return payloads.flat().map((question) => ({ question, subject }));
          }),
        );

        const mergedQuestions = groupedPayloads
          .flat()
          .map(({ question, subject }) => {
            if (typeof question !== "object" || question === null) {
              return question;
            }

            return {
              ...(question as Omit<QuizQuestion, "oblast">),
              oblast: subject,
            };
          });
        const parsedQuestions = mergedQuestions.filter(isQuizQuestion);

        if (parsedQuestions.length === 0) {
          throw new Error("Nema validnih pitanja u bazi.");
        }

        if (cancelled) {
          return;
        }

        setAllQuestions(parsedQuestions);
        setSelectedSubject(null);
        setQuestions([]);
        setSelectedCategory(null);
        setCurrentIndex(0);
        setSelectedAnswers([]);
        setSubmittedAnswers(null);
        setScore(0);
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Došlo je do greške.",
        );
      }
    }

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentQuestion = questions[currentIndex];
  const subjectQuestions = selectedSubject
    ? allQuestions.filter((question) => question.oblast === selectedSubject)
    : [];
  const categories = Array.from(
    new Set(subjectQuestions.map((question) => question.kategorija)),
  ).sort((left, right) => left.localeCompare(right, "sr"));
  const categoryGridClassName =
    categories.length <= 2
      ? "mx-auto w-full max-w-3xl sm:grid-cols-2"
      : "w-full sm:grid-cols-2 lg:grid-cols-4";
  const hasQuestions = questions.length > 0;
  const isComplete = hasQuestions && currentIndex >= questions.length;
  const hasSubmittedAnswer = submittedAnswers !== null;
  const correctAnswers = currentQuestion?.tacan_odgovor ?? [];
  const isTextInputQuestion = currentQuestion
    ? ["upisivanje", "dopunjivanje"].includes(
        normalizeQuestionType(currentQuestion.tip),
      )
    : false;
  const isMultiAnswerQuestion = !isTextInputQuestion && correctAnswers.length > 1;

  const submittedOptionLabels = submittedAnswers ?? [];

  function areSameSelections(left: string[], right: string[]) {
    if (left.length !== right.length) {
      return false;
    }

    const rightSet = new Set(right);

    return left.every((value) => rightSet.has(value));
  }

  function toggleAnswer(optionLabel: string) {
    if (hasSubmittedAnswer) {
      return;
    }

    if (isMultiAnswerQuestion) {
      setSelectedAnswers((current) =>
        current.includes(optionLabel)
          ? current.filter((value) => value !== optionLabel)
          : [...current, optionLabel],
      );

      return;
    }

    setSelectedAnswers([optionLabel]);
  }

  function resetRound() {
    if (!selectedCategory) {
      return;
    }

    const filteredQuestions = allQuestions.filter(
      (question) =>
        question.kategorija === selectedCategory &&
        question.oblast === selectedSubject,
    );

    if (filteredQuestions.length === 0) {
      return;
    }

    setQuestions(createRound(filteredQuestions, questionOrder));
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setTextAnswer("");
    setSubmittedAnswers(null);
    setScore(0);
  }

  function selectCategory(category: string) {
    const filteredQuestions = allQuestions.filter(
      (question) =>
        question.kategorija === category && question.oblast === selectedSubject,
    );

    setSelectedCategory(category);
    setQuestions(createRound(filteredQuestions, questionOrder));
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setTextAnswer("");
    setSubmittedAnswers(null);
    setScore(0);
  }

  function selectSubject(subject: Subject) {
    setSelectedSubject(subject);
    setSelectedCategory(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setTextAnswer("");
    setSubmittedAnswers(null);
    setScore(0);
  }

  function clearSubjectSelection() {
    setSelectedSubject(null);
    setSelectedCategory(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setTextAnswer("");
    setSubmittedAnswers(null);
    setScore(0);
  }

  function clearCategorySelection() {
    setSelectedCategory(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setTextAnswer("");
    setSubmittedAnswers(null);
    setScore(0);
  }

  function handleAnswerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentQuestion || hasSubmittedAnswer) {
      return;
    }

    if (isTextInputQuestion) {
      const trimmedInput = textAnswer.trim();

      if (trimmedInput.length === 0) {
        return;
      }

      setSubmittedAnswers([trimmedInput]);

      return;
    }

    if (selectedAnswers.length === 0) {
      return;
    }

    const isCorrect = areSameSelections(selectedAnswers, correctAnswers);

    setSubmittedAnswers(selectedAnswers);

    if (isCorrect) {
      setScore((value) => value + 1);
    }
  }

  function handleNextQuestion() {
    setSubmittedAnswers(null);
    setSelectedAnswers([]);
    setTextAnswer("");
    setCurrentIndex((value) => value + 1);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 text-center shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-300/30 border-t-cyan-300" />
            <p className="text-lg font-semibold">Učitavam pitanja...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center rounded-[2rem] border border-rose-400/20 bg-slate-950/70 p-8 text-center shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-300">
              Greška
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">
              Kviz nije mogao da se učita.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              Pokušaj ponovo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedSubject) {
    return (
      <div className="h-[100dvh] overflow-hidden p-3 text-slate-100 sm:p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)]" />

        <section className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-3">
          <header className="rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Informator kviz
            </p>
            <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Izaberi oblast.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Prvo biraš oblast, pa podkategoriju i pitanja.
            </p>
          </header>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-3 shadow-xl shadow-slate-950/25 backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Redosled pitanja
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1 sm:mt-0 sm:w-72">
              <button
                type="button"
                aria-pressed={questionOrder === "random"}
                onClick={() => setQuestionOrder("random")}
                className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
                  questionOrder === "random"
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                Nasumično
              </button>
              <button
                type="button"
                aria-pressed={questionOrder === "sequential"}
                onClick={() => setQuestionOrder("sequential")}
                className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
                  questionOrder === "sequential"
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                Redom
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SUBJECTS.map((subject) => {
              const questionCount = allQuestions.filter(
                (question) => question.oblast === subject,
              ).length;

              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => selectSubject(subject)}
                  className="rounded-[2rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-left shadow-2xl shadow-slate-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900/70"
                >
                  <p className="text-xl font-semibold text-white">{subject}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {questionCount} pitanja
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div className="h-[100dvh] overflow-hidden p-3 text-slate-100 sm:p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)]" />

        <section className="mx-auto flex h-full min-h-0 max-w-5xl flex-col justify-center gap-3">
          <header className="rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300 sm:text-sm">
                  Informator kviz
                </p>
                <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Izaberi kategoriju
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Oblast: {selectedSubject}
                </p>
              </div>

              <button
                type="button"
                onClick={clearSubjectSelection}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/10"
              >
                Nazad
              </button>
            </div>
          </header>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Dostupne kategorije
            </p>

            <div className={`mt-3 grid gap-2 ${categoryGridClassName}`}>
              {categories.map((category) => {
                const questionCount = allQuestions.filter(
                  (question) =>
                    question.kategorija === category &&
                    question.oblast === selectedSubject,
                ).length;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => selectCategory(category)}
                    className="flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold leading-5 text-white">{category}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      {questionCount} pitanja
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!hasQuestions) {
    return (
      <div className="min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 text-center shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {selectedCategory}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">
              Nema pitanja za ovu kategoriju.
            </h1>
            <button
              type="button"
              onClick={clearCategorySelection}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              Izaberi drugu kategoriju
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center gap-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Kviz završen
              </p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                Osvojio si {score} od {questions.length} poena.
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                Oblast: {selectedSubject} | Kategorija: {selectedCategory}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Tačnost
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {Math.round((score / questions.length) * 100)}%
              </p>
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            {questionOrder === "random"
              ? "Pitanja su bila nasumično raspoređena."
              : "Pitanja su išla redom po rednom broju."}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetRound}
              className="inline-flex h-12 w-fit items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              Igraj ponovo
            </button>
            <button
              type="button"
              onClick={clearCategorySelection}
              className="inline-flex h-12 w-fit items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Promeni kategoriju
            </button>
            <button
              type="button"
              onClick={clearSubjectSelection}
              className="inline-flex h-12 w-fit items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Promeni oblast
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden p-3 text-slate-100 sm:p-4 lg:p-5">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)]" />

      <section className="mx-auto flex h-full max-w-5xl flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={clearCategorySelection}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/10"
          >
            Nazad
          </button>
        </div>

        <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-3 shadow-xl shadow-slate-950/25 backdrop-blur sm:grid-cols-3 sm:p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Pitanje
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {currentIndex + 1}/{questions.length}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              Redni broj: {currentQuestion.id}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Rezultat
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {score} tačnih
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Kategorija
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {currentQuestion.oblast} | {currentQuestion.kategorija}
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 transition-all duration-500"
            style={{
              width: `${((currentIndex + (hasSubmittedAnswer ? 1 : 0)) / questions.length) * 100}%`,
            }}
          />
        </div>

        <article className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-5">
          <form onSubmit={handleAnswerSubmit} className="flex h-full flex-col gap-4">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <h2 className="whitespace-pre-line text-lg font-semibold leading-7 text-white sm:text-xl">
                  {currentQuestion.pitanje}
                  {isMultiAnswerQuestion && (
                    <span className="ml-3 inline-flex align-middle rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      Više tačnih odgovora
                    </span>
                  )}
                </h2>
              </div>

              {isTextInputQuestion ? (
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="text-answer">
                    Unesi odgovor
                  </label>
                  <input
                    id="text-answer"
                    type="text"
                    value={textAnswer}
                    onChange={(event) => setTextAnswer(event.target.value)}
                    disabled={hasSubmittedAnswer}
                    className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Upiši svoj odgovor"
                  />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentQuestion.opcije.map((option) => {
                    const isSelected = selectedAnswers.includes(option.oznaka);
                    const isCorrectChoice = hasSubmittedAnswer && correctAnswers.includes(option.oznaka);
                    const isWrongSelection = hasSubmittedAnswer && isSelected && !isCorrectChoice;

                    return (
                      <button
                        key={option.oznaka}
                        type="button"
                        onClick={() => toggleAnswer(option.oznaka)}
                        className={`min-h-[3.8rem] rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                          isCorrectChoice
                            ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-50"
                            : isWrongSelection
                              ? "border-rose-400/60 bg-rose-400/15 text-rose-50"
                              : isSelected
                                ? "border-cyan-300/70 bg-cyan-300/15 text-white"
                                : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-semibold">
                            {option.oznaka}
                          </span>
                          <span className="pt-0.5 text-sm leading-5">
                            {option.tekst}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {hasSubmittedAnswer && (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Rezultat pitanja
                  </p>
                  {isTextInputQuestion ? (
                    <>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Tvoj odgovor: <span className="font-semibold text-white">{submittedOptionLabels.join(", ")}</span>
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Tačan odgovor: <span className="font-semibold text-white">{correctAnswers.join(", ")}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {areSameSelections(submittedOptionLabels, correctAnswers) ? "Tačno" : "Netačno"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Izabrao si <span className="font-semibold text-white">{submittedOptionLabels.join(", ")}</span>. Tačan odgovor je <span className="font-semibold text-white">{correctAnswers.join(", ")}</span>.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={
                  hasSubmittedAnswer ||
                  (isTextInputQuestion
                    ? textAnswer.trim().length === 0
                    : selectedAnswers.length === 0)
                }
                className="inline-flex h-10 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Proveri odgovor
              </button>

              {hasSubmittedAnswer && (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Sledeće pitanje
                </button>
              )}
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}
