import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

// Web only: the HTML document around the app during static rendering.
// Native builds never use this file.
export default function Root({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#000000" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Black page behind the app (no white flash), and a clearly visible ring for
// keyboard focus only — mouse and touch users never see it.
const globalStyles = `
body { background-color: #000; }
:focus-visible { outline: 2px solid #fff !important; outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }
`;
