import { html, htmlToResponse } from "@mastrojs/mastro";

export const GET = () => {
  return htmlToResponse(html`
    <!DOCTYPE html>

    <h1>SSE</h1>
    <a href="https://mastrojs.github.io/guide/caching-service-workers-streaming/#http-streaming">
      Server-sent events
    </a>
    <ul></ul>

    <script type="module">
    const ul = document.querySelector("ul");
    const eventSource = new EventSource("/sse");
    eventSource.onmessage = (event) => {
      const li = document.createElement("li");
      const chunk = JSON.parse(event.data);
      li.textContent = chunk.i;
      ul.appendChild(li);
    };
    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
    };
    window.addEventListener("beforeunload", () => {
      eventSource.close();
    });
    </script>
  `);
};
