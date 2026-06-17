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
  pitanje: string;
  tip: string;
  opcije: QuizOption[];
  tacan_odgovor: string[];
};

type LoadStatus = "loading" | "ready" | "error";

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

function createRound(sourceQuestions: QuizQuestion[]) {
  return shuffleArray(sourceQuestions);
}

export function QuizGame() {
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<string[] | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        setStatus("loading");
        setErrorMessage("");

        const response = await fetch("/pitanja-sva.json");

        if (!response.ok) {
          throw new Error("Ne mogu da učitam pitanja.");
        }

        const data = (await response.json()) as QuizQuestion[];

        if (cancelled) {
          return;
        }

        setAllQuestions(data);
        setQuestions(createRound(data));
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
  const hasQuestions = questions.length > 0;
  const isComplete = hasQuestions && currentIndex >= questions.length;
  const hasSubmittedAnswer = submittedAnswers !== null;
  const correctAnswers = currentQuestion?.tacan_odgovor ?? [];
  const isMultiAnswerQuestion = correctAnswers.length > 1;

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
    if (allQuestions.length === 0) {
      return;
    }

    setQuestions(createRound(allQuestions));
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setSubmittedAnswers(null);
    setScore(0);
  }

  function handleAnswerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentQuestion || selectedAnswers.length === 0 || hasSubmittedAnswer) {
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

  if (!hasQuestions) {
    return null;
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
            Pitanja se nasumično raspoređuju pri svakom novom pokretanju.
          </p>

          <button
            type="button"
            onClick={resetRound}
            className="inline-flex h-12 w-fit items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
          >
            Igraj ponovo
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)]" />

      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col justify-center gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-6 lg:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Informator kviz
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Kviz napravljen radi vežbanja pitanja iz informatora za Fakultet veterinarske medicine.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Odgovori na pitanje, vidi trenutni rezultat i pokreni novu rundu
            kad god želiš.
          </p>
        </header>

        <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-slate-950/25 backdrop-blur sm:grid-cols-3 sm:p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Pitanje
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {currentIndex + 1}/{questions.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Rezultat
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {score} tačnih
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Kategorija
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {currentQuestion.kategorija}
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

        <article className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-6 lg:p-8">
          <form onSubmit={handleAnswerSubmit} className="space-y-6">
            <div className="space-y-3">
              <h2 className="whitespace-pre-line text-xl font-semibold leading-8 text-white sm:text-2xl">
                {currentQuestion.pitanje}
                {isMultiAnswerQuestion && (
                  <span className="ml-3 inline-flex align-middle rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                    Više tačnih odgovora
                  </span>
                )}
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.opcije.map((option) => {
                const isSelected = selectedAnswers.includes(option.oznaka);
                const isCorrectChoice = hasSubmittedAnswer && correctAnswers.includes(option.oznaka);
                const isWrongSelection = hasSubmittedAnswer && isSelected && !isCorrectChoice;

                return (
                  <button
                    key={option.oznaka}
                    type="button"
                    onClick={() => toggleAnswer(option.oznaka)}
                    className={`min-h-[4.5rem] rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                      isCorrectChoice
                        ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-50"
                        : isWrongSelection
                          ? "border-rose-400/60 bg-rose-400/15 text-rose-50"
                          : isSelected
                            ? "border-cyan-300/70 bg-cyan-300/15 text-white"
                            : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-current/20 text-sm font-semibold">
                        {option.oznaka}
                      </span>
                      <span className="pt-1 text-sm leading-6 sm:text-base">
                        {option.tekst}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={selectedAnswers.length === 0 || hasSubmittedAnswer}
                className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Proveri odgovor
              </button>

              {hasSubmittedAnswer && (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Sledeće pitanje
                </button>
              )}
            </div>

            {hasSubmittedAnswer && (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Rezultat pitanja
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {areSameSelections(submittedOptionLabels, correctAnswers) ? "Tačno" : "Netačno"}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Izabrao si <span className="font-semibold text-white">{submittedOptionLabels.join(", ")}</span>. Tačan odgovor je <span className="font-semibold text-white">{correctAnswers.join(", ")}</span>.
                </p>
              </div>
            )}
          </form>
        </article>
      </section>
    </div>
  );
}