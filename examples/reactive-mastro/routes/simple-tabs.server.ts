import { Layout } from "../components/Layout.ts"
import { html, htmlToResponse } from "@mastrojs/mastro";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "Simple-tabs example",
      children: html`
        <simple-tabs>
          <button data-onclick="switchTo('home')">Home</button>
          <button data-onclick="switchTo('profile')">Profile</button>

          <section data-bind="class.hidden=isNotActiveTab('home')">
            <h3>Home</h3>
            <p>My home is my castle.</p>
          </section>

          <section data-bind="class.hidden=isNotActiveTab('profile')">
            <h3>Profile</h3>
            <p>My name is...</p>
          </section>
        </simple-tabs>

        <script type="module" src="/simple-tabs.client.js"></script>
        `
    })
)
