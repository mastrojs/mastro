import { html } from "@mastrojs/mastro";

export const Footer = () =>
  html`
    <footer>
      <div>
        Check us out
        <a href="https://github.com/mastrojs/mastro">on GitHub</a>.
        © ${new Date().getFullYear()}
      </div>
    </footer>
  `;
