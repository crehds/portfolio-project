// What the browser runs in place of Turnstile's `api.js` in the end-to-end tests (see
// `contact-test.ts`, which serves it at the script's real address). The real script draws
// an iframe and, once the visitor passes the challenge, puts the token in a hidden field
// named `cf-turnstile-response` inside the widget's container, which sits in the form. The
// stub does the field and nothing else: no iframe, no network, no challenge.
//
// The token comes from `window.__E2E_TURNSTILE__.token`, which each test sets before the
// page loads (`useWidgetToken`): a string for a widget that has solved its challenge, and
// `null` for one that has not (a blocked script, a visitor who submits too soon), which
// leaves the form without a token. Every widget it finds is also recorded in
// `window.__e2eTurnstileRenders`, with the attributes the page gave it, so a test can say
// what the page asked Turnstile for.
export const TURNSTILE_API_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js';

export const TURNSTILE_STUB = `
(function () {
  var config = window.__E2E_TURNSTILE__ || { token: null };
  var renders = (window.__e2eTurnstileRenders = window.__e2eTurnstileRenders || []);

  function render(widget) {
    renders.push({
      sitekey: widget.getAttribute('data-sitekey'),
      language: widget.getAttribute('data-language'),
      size: widget.getAttribute('data-size'),
      theme: widget.getAttribute('data-theme'),
    });

    if (typeof config.token !== 'string') {
      return;
    }

    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'cf-turnstile-response';
    input.value = config.token;
    widget.appendChild(input);
  }

  function scan() {
    var widgets = document.querySelectorAll('.cf-turnstile');
    for (var i = 0; i < widgets.length; i += 1) {
      render(widgets[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
`;
