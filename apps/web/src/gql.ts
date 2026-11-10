export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  auth?: { username: string; role: string }
): Promise<T> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth?.username ? { 'x-username': auth.username } : {}),
      ...(auth?.role ? { 'x-user-role': auth.role } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) {
    throw new Error('Không nhận được dữ liệu từ GraphQL');
  }
  return json.data;
}
