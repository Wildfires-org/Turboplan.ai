import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

export const turboplanUrl = getLandingPageEnv().TURBOPLAN_URL;

export async function get<T, P = Record<string, unknown>>(
  path: string,
  params?: P,
  options: NextFetchRequestConfig = {},
): Promise<T> {
  const url = new URL(`${turboplanUrl}/${path}`);

  if (params) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const arrayKey = `${key}[]`;
        value.forEach((v) => searchParams.append(arrayKey, v.toString()));
      } else if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    url.search = searchParams.toString();
  }

  const res = await fetch(url, { next: options });
  return res.json();
}

export async function post<T, P = {}>(path: string, data?: P): Promise<T> {
  const url = new URL(`${turboplanUrl}/${path}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  return res.json();
}
