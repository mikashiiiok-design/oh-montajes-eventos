export async function onRequest({ request, env }) {
  const incomingUrl = new URL(request.url)
  const apiOrigin = (env.API_ORIGIN ?? 'https://oh-api-test.onrender.com').replace(/\/$/, '')
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin)

  return fetch(new Request(upstreamUrl, request))
}