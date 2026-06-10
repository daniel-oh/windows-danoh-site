import { settingsAtom } from "@/state/settings";
import { getDefaultStore } from "jotai";
import { alert } from "./alert";

export function showUpsell() {
  alert({
    alertId: "OUT_OF_CREDITS",
    title: "Out of tokens",
    message: (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p>You&apos;re out of tokens for full-quality generations.</p>
        <p>To keep going, you have two options:</p>
        <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
          <li>Buy more tokens</li>
          <li>Switch to the free model (smaller, scrappier)</li>
        </ul>
      </div>
    ),
    icon: "x",
    actions: [
      {
        label: "Use Free Model",
        callback: (close) => {
          getDefaultStore().set(settingsAtom, {
            ...getDefaultStore().get(settingsAtom),
            model: "cheap",
          });
          close();
        },
      },
      {
        label: "Get Tokens",
        callback: (close) => {
          const form = document.createElement("form");
          form.method = "POST";
          form.action = "/api/checkout";
          form.target = "_blank";
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
          close();
        },
      },
    ],
  });
}
