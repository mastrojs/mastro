import { html } from "@mastrojs/mastro";

export const Footer = () =>
  html`
    <footer>
      <div>
        © ${new Date().getFullYear()}
        – Built with
        <a href="https://mastrojs.github.io/">Mastro</a>
      </div>
    </footer>
  `;
