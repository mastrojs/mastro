import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.js";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "Home",
      children: html`
        <nav>
          <p>👉 <a href="/news/">News</a></p>
        </nav>

        <h1>Common HTML elements</h1>
        <p>
          Let's go through the most important HTML elements to
          structure your content:
        </p>

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
