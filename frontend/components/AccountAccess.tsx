import type { ReactNode } from "react";
import { AccountHeader } from "./AccountHeader";
import { NeuralAccessLogin } from "./ui/neural-access-login";

export function AccountAccess({
  current,
  children,
}: {
  current: "login" | "register" | "recovery";
  children: ReactNode;
}) {
  return (
    <NeuralAccessLogin>
      <AccountHeader current={current} />
      <main
        className={`neural-auth-shell${current === "login" ? "" : " neural-auth-shell--extended"}`}
      >
        <div className="sign-in-content">{children}</div>
      </main>
    </NeuralAccessLogin>
  );
}
