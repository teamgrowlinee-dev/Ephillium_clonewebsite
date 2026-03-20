(function () {
  const contactErrorText =
    "Sorry, we were not able to submit the form. Please review the errors and try again.";
  const contactSuccessText = "Thanks for getting in touch!";

  const setVisible = (element, visible) => {
    if (!element) {
      return;
    }

    element.style.display = visible ? "block" : "none";
  };

  const getContactState = (form) => {
    const wrapper = form.closest(".contact-full__form");
    const errorBox = wrapper ? wrapper.querySelector(".b12-form-error") : null;
    let successBox = wrapper ? wrapper.querySelector(".local-contact-success") : null;

    if (!successBox && wrapper) {
      successBox = document.createElement("div");
      successBox.className = "b12-form-done local-contact-success";
      successBox.textContent = contactSuccessText;
      successBox.style.display = "none";
      form.insertAdjacentElement("afterend", successBox);
    }

    return {errorBox, successBox};
  };

  const setButtonLoading = (form, loading) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) {
      return;
    }

    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }

    button.disabled = loading;
    button.textContent = loading ? "Submitting..." : button.dataset.defaultLabel;
  };

  const submitJson = async (url, payload) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  };

  const bindContactForm = (form) => {
    const checkbox = form.querySelector('input[type="checkbox"]');
    const {errorBox, successBox} = getContactState(form);

    if (checkbox) {
      checkbox.required = true;
    }

    setVisible(errorBox, false);
    setVisible(successBox, false);

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        if (!form.reportValidity()) {
          return;
        }

        const payload = {
          name: form.querySelector('input[name="name"]')?.value.trim() || "",
          from_email:
            form.querySelector('input[name="from_email"]')?.value.trim() || "",
          from_phone:
            form.querySelector('input[name="from_phone"]')?.value.trim() || "",
          message:
            form.querySelector('textarea[name="message"]')?.value.trim() || "",
          consent: Boolean(checkbox?.checked),
        };

        setButtonLoading(form, true);
        setVisible(errorBox, false);
        setVisible(successBox, false);

        try {
          const ok = await submitJson("/api/contact", payload);
          if (!ok) {
            setVisible(errorBox, true);
            return;
          }

          form.reset();
          setVisible(successBox, true);
        } catch {
          setVisible(errorBox, true);
        } finally {
          if (errorBox) {
            errorBox.textContent = contactErrorText;
          }
          setButtonLoading(form, false);
        }
      },
      true,
    );
  };

  const bindNewsletterForm = (form) => {
    const popup = form.closest(".sb-popup__content") || form.parentElement;
    const emailInput = form.querySelector('input[name="from_email"]');
    const successBox = popup?.querySelector(".newsletter-signup-form__done");
    const errorBox = popup?.querySelector(".newsletter-signup-form__error");

    if (emailInput) {
      emailInput.required = true;
    }

    setVisible(successBox, false);
    setVisible(errorBox, false);

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        if (!form.reportValidity()) {
          return;
        }

        setButtonLoading(form, true);
        setVisible(successBox, false);
        setVisible(errorBox, false);

        try {
          const ok = await submitJson("/api/newsletter", {
            from_email: emailInput?.value.trim() || "",
          });

          if (!ok) {
            setVisible(errorBox, true);
            return;
          }

          form.reset();
          setVisible(form, false);
          setVisible(successBox, true);
        } catch {
          setVisible(errorBox, true);
        } finally {
          setButtonLoading(form, false);
        }
      },
      true,
    );
  };

  const init = () => {
    const contactForm = document.querySelector(".contact-full__form form.js-form");
    if (contactForm) {
      bindContactForm(contactForm);
    }

    document
      .querySelectorAll("form.newsletter-signup-form")
      .forEach((form) => bindNewsletterForm(form));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once: true});
  } else {
    init();
  }

  (function loadChatbot() {
    var s1 = document.createElement("script");
    s1.src = "/_local/chatbot-config.js";
    document.body.appendChild(s1);
    s1.onload = function () {
      var s2 = document.createElement("script");
      s2.src = "/_local/chatbot-widget.js";
      document.body.appendChild(s2);
    };
  })();
})();
