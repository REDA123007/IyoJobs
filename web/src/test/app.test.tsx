import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { ApiError, type Api, type Job, type JobsQuery } from "../api/client";
import { ApiProvider } from "../api/context";
import { PAGE_SIZE } from "../pages/Jobs";
import { I18nProvider, type LangCode } from "../i18n";

function job(n: number, over: Partial<Job> = {}): Job {
  return {
    id: `job-${n}`,
    company_id: "c1",
    title: `Job title ${n}`,
    description: `Description for job number ${n}, long enough to read.`,
    country: "MA",
    locale: "en",
    skills: ["python", "sql"],
    remote: n % 2 === 0,
    status: "open",
    ...over,
  };
}

function fakeApi(impl: (q: JobsQuery) => Promise<Job[]>): { api: Api; calls: JobsQuery[] } {
  const calls: JobsQuery[] = [];
  const api: Api = {
    searchJobs: (query = {}) => {
      calls.push(query);
      return impl(query);
    },
  };
  return { api, calls };
}

function renderApp(api: Api, path = "/", lang: LangCode = "en") {
  return render(
    <I18nProvider initial={lang}>
      <ApiProvider api={api}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ApiProvider>
    </I18nProvider>,
  );
}

async function accessibilityViolations(container: HTMLElement) {
  // color-contrast needs real layout; it is covered separately by contrast.test.ts against the tokens.
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
}

describe("Home", () => {
  it("shows the value proposition, working search, and honest availability labels", () => {
    renderApp(fakeApi(async () => []).api);
    expect(screen.getByRole("heading", { level: 1, name: /fits your life/i })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    const list = screen.getByText(/What works today/i).closest("section") as HTMLElement;
    expect(within(list).getByText("Job search and filters").closest("li")).toHaveTextContent("Available");
    expect(within(list).getByText(/Accounts, saved jobs/i).closest("li")).toHaveTextContent(/In development/i);
    expect(within(list).getByText("Employer workspace").closest("li")).toHaveTextContent("Planned");
  });

  it("makes no claims of fake users, ratings or job counts", () => {
    const { container } = renderApp(fakeApi(async () => []).api);
    expect(container.textContent).not.toMatch(/\d[\d,.]*\s*(\+|users|jobs|companies|reviews)/i);
    expect(container.textContent).not.toMatch(/★|rated|testimonial/i);
  });

  it("submitting the search opens the jobs page with the keyword applied", async () => {
    const { api, calls } = fakeApi(async () => [job(1)]);
    renderApp(api);
    await userEvent.type(screen.getByLabelText(/What kind of job/i), "python dev");
    await userEvent.click(screen.getByRole("button", { name: "Search jobs" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Job openings" })).toBeInTheDocument();
    await waitFor(() => expect(calls.at(-1)?.q).toBe("python dev"));
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = renderApp(fakeApi(async () => []).api);
    expect(await accessibilityViolations(container)).toEqual([]);
  });
});

describe("Jobs page states", () => {
  it("loading → success, with the job's own details and clearly unknown eligibility", async () => {
    let release!: (jobs: Job[]) => void;
    const { api } = fakeApi(() => new Promise<Job[]>((resolve) => (release = resolve)));
    renderApp(api, "/jobs");
    expect(screen.getByText("Loading jobs…", { selector: "[role=status]" })).toBeInTheDocument();
    release([job(1, { country: "FR", locale: "ar", title: "مهندس برمجيات" })]);
    const card = (await screen.findByRole("article")) as HTMLElement;
    expect(within(card).getByRole("heading", { name: "مهندس برمجيات" })).toHaveAttribute("dir", "rtl");
    expect(within(card).getByRole("heading", { name: "مهندس برمجيات" })).toHaveAttribute("lang", "ar");
    expect(card).toHaveTextContent("Location: France");
    expect(card).toHaveTextContent("Job text language: العربية");
    expect(card).toHaveTextContent("Who can apply: not specified");
    expect(screen.getByRole("status")).toHaveTextContent("Results on this page: 1");
  });

  it("empty state", async () => {
    renderApp(fakeApi(async () => []).api, "/jobs");
    expect(await screen.findByRole("heading", { name: "No jobs match these filters" })).toBeInTheDocument();
  });

  it("error state offers a working retry", async () => {
    let fail = true;
    const { api, calls } = fakeApi(async () => {
      if (fail) throw new ApiError(null, "network_error");
      return [job(1)];
    });
    renderApp(api, "/jobs");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not load jobs");
    fail = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it("success state has no accessibility violations", async () => {
    const { container } = renderApp(fakeApi(async () => [job(1), job(2)]).api, "/jobs");
    await screen.findAllByRole("article");
    expect(await accessibilityViolations(container)).toEqual([]);
  });

  it("error state has no accessibility violations", async () => {
    const { container } = renderApp(
      fakeApi(async () => {
        throw new ApiError(500, "request_failed");
      }).api,
      "/jobs",
    );
    await screen.findByRole("alert");
    expect(await accessibilityViolations(container)).toEqual([]);
  });
});

describe("Jobs filters and paging", () => {
  it("sends filters to the API and reads them back from the URL", async () => {
    const { api, calls } = fakeApi(async () => []);
    renderApp(api, "/jobs?q=python&country=MA&remote=1&page=1");
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toMatchObject({ q: "python", country: "MA", remote: true, offset: 0, limit: PAGE_SIZE + 1 });
    expect(screen.getByLabelText("Keyword")).toHaveValue("python");
    expect(screen.getByLabelText("Job location (country)")).toHaveValue("MA");
    expect(screen.getByLabelText("Work arrangement")).toHaveValue("remote");
  });

  it("applying the form issues a new query; reset clears it", async () => {
    const { api, calls } = fakeApi(async () => []);
    renderApp(api, "/jobs");
    await userEvent.type(screen.getByLabelText("Keyword"), "nurse");
    await userEvent.selectOptions(screen.getByLabelText("Work arrangement"), "onsite");
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ q: "nurse", remote: false }));
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(calls.at(-1)?.q).toBeUndefined());
    expect(screen.getByLabelText("Keyword")).toHaveValue("");
  });

  it("the country list contains every country and narrows by typing", async () => {
    renderApp(fakeApi(async () => []).api, "/jobs");
    const select = screen.getByLabelText("Job location (country)") as HTMLSelectElement;
    expect(select.options.length).toBe(1 + 250); // "any" + 249 ISO + Kosovo
    await userEvent.type(screen.getByRole("searchbox", { name: "Search countries" }), "morocc");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["Any country", "Morocco"]);
  });

  it("pagination uses one extra row to detect a next page and never shows it", async () => {
    const all = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => job(i + 1));
    const { api, calls } = fakeApi(async (q) => all.slice(q.offset ?? 0, (q.offset ?? 0) + (q.limit ?? 0)));
    renderApp(api, "/jobs");
    expect(await screen.findAllByRole("article")).toHaveLength(PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(calls.at(-1)?.offset).toBe(PAGE_SIZE));
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
  });
});

describe("language and direction", () => {
  it("switching to Arabic sets lang/dir on <html>, translates the UI and country names", async () => {
    renderApp(fakeApi(async () => [job(1)]).api, "/jobs");
    await userEvent.selectOptions(screen.getByLabelText("Language"), "ar");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(await screen.findByRole("heading", { level: 1, name: "الوظائف المتاحة" })).toBeInTheDocument();
    expect(await screen.findByRole("article")).toHaveTextContent("المكان: المغرب");
  });

  it("remembers the choice without breaking when storage is blocked", async () => {
    renderApp(fakeApi(async () => []).api);
    await userEvent.selectOptions(screen.getByLabelText("Language"), "fr");
    expect(window.localStorage.getItem("iyojobs.lang")).toBe("fr");
    expect(document.documentElement.dir).toBe("ltr");
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await userEvent.selectOptions(screen.getByLabelText("Langue"), "de");
    expect(document.documentElement.lang).toBe("de");
    spy.mockRestore();
  });

  it.each(["ar", "en", "fr", "ru", "de", "it", "es"] as const)("renders home and jobs in %s without violations", async (lang) => {
    const { container } = renderApp(fakeApi(async () => [job(1)]).api, "/jobs", lang);
    await screen.findByRole("article");
    expect(await accessibilityViolations(container)).toEqual([]);
  });
});

describe("shell", () => {
  it("has a skip link, landmarks, the logo with its alt text, and a preview banner", () => {
    renderApp(fakeApi(async () => []).api);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    const logo = screen.getAllByAltText("IyoJobs")[0] as HTMLImageElement;
    // intrinsic ratio of the supplied logo is kept: 868 x 597
    expect(Number(logo.getAttribute("width")) / Number(logo.getAttribute("height"))).toBeCloseTo(868 / 597, 1);
    expect(screen.getByRole("note")).toHaveTextContent(/not the production service/i);
  });

  it("unknown routes show a not-found page", () => {
    renderApp(fakeApi(async () => []).api, "/nope");
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});
