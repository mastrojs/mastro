import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.ts";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "Welcome to your website!",
      children: html`
        <p>
          This is the home page containing an introduction to the most common HTML elements.
          Check out <code>routes/index.server.ts</code> to see the source.
        </p>

        <p>
          👉 <a href="/news/">News</a> are on a separate page: <code>routes/news/index.server.ts</code>.
          But you can rename the folders inside <code>routes</code> to change the URLs of your pages.
          See <a href="https://mastrojs.github.io/docs/routing/">Mastro's routing docs</a>.
        </p>

        <p>
          Edit the CSS in <code>routes/styles.css</code>, or use your
          <a href="https://mastrojs.github.io/guide/css/#inspect-your-website-with-your-browser%E2%80%99s-developer-tools">
            browser's developer tools
          </a> to play around with it.
          For example, change the CSS variables set on the <code>&lt;html&gt;</code> element.
        </p>

        <p>Have fun! If you get stuck:</p>

        <ul>
          <li><a href="https://mastrojs.github.io/docs/">Mastro Docs</a></li>
          <li><a href="https://mastrojs.github.io/guide/">Guide to web development</a></li>
          <li>
            Ask questions on <a href="https://github.com/mastrojs/mastro/discussions">GitHub Discussions</a>
            or the <a href="https://stt.gg/k7QMEaP1">Mastro Chat</a>.
          </li>
        </ul>

        <h2>Paragraphs</h2>
        <p>The p element marks a paragraph of text.</p>

        <h2>Headings</h2>
        <p>
          At the very top of the body, we have the heading of this page
          in an h1 element. This is what search engines (like Google)
          and screen readers (used by visually impaired readers) look for
          when they want to know what the page's title is. Therefore, you
          should only ever have one h1 element on any given page.
        </p>
        <p>
          The h2 element is a sub-heading. HTML has h1 up to h6 elements,
          to mark progressively deeper nested sub-headings. You should
          use those to mark the structure of your page. All headings
          together should act like a table of contents for your page.
        </p>

        <h2>Lists</h2>
        <p>
          Let's add an ordered list
          (meaning the list markers will be numbers):
        </p>
        <ol>
          <li>list item one</li>
          <li>list item two</li>
          <li>list item three</li>
        </ol>
        <p>
          and an unordered list
          (the list markers will be bullet points):
        </p>
        <ul>
          <li>list item one</li>
          <li>list item two</li>
          <li>list item three</li>
        </ul>

        <h2>Formatting</h2>
        <p>
          Note how all elements introduced so far cause a line-break
          before and after them? That's because they are so-called
          <a href="https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content">block elements</a>.
        </p>
        <p>
          However, links (like the a element we just saw),
          <em>emphasis</em> (rendered as italics), and
          <strong>strong emphasis</strong> (rendered bold),
          are all inline elements. That means they don't cause
          any line-breaks by default.
        </p>

        <h2>An image</h2>
        <img src="chair.jpg" alt="A chair" height="300">
        <p>
          We will add an image file <code>chair.jpg</code> later.
        </p>
        <p>
          For now, note the alt attribute on the image. It is required
          and contains "alternative text" that is read to visually
          impaired readers, or shown if the image fails to load.
        </p>
        <p>
          If the image is relevant content, the alt text should
          therefore be a brief description of what's in the image.
          If the image is just decoration, you should use alt="".
        </p>
      `,
    }),
  );
