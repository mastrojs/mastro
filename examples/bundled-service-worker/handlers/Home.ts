import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../sw/components/Layout.ts";

export const handler = () =>
  htmlToResponse(
    Layout({
      title: "Hello World",
      children: html`

        <p>Loading...</p>

        <script type="module">
          if ("serviceWorker" in navigator) {
            try {
              const registration = await navigator.serviceWorker.register("/sw.js", {
                type: "module"
              });
              if (registration.installing) {
                console.log("Service worker installing");
              } else if (registration.waiting) {
                console.log("Service worker installed but waiting for other tabs to close.");
              } else if (registration.active) {
                console.log("Service worker active");
              }
              const worker = registration.active || registration.installing;
              if (worker) {
                worker.onstatechange = () => {
                  if (worker.state === 'installed') {
                    window.location.reload();
                  }
                };
              }
            } catch (error) {
              console.error("Registration failed with ", error);
              alert("Oops, couldn't load app: " + error.message);
            }
          } else {
            alert("Service Workers not supported in this browser or mode");
          }
        </script>
      `,
    }),
  );
