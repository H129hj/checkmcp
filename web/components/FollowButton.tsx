"use client";
import { useFormStatus } from "react-dom";
import { followMonitor } from "../app/account/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm btn-outline w-full" type="submit" disabled={pending}>
      {pending ? <span className="loading loading-spinner loading-xs" /> : "+ Track this server"}
    </button>
  );
}

// Suit le serveur (privé). Non connecté → l'action redirige vers /login.
export default function FollowButton({ url }: { url: string }) {
  return (
    <form action={followMonitor} className="w-full">
      <input type="hidden" name="url" value={url} />
      <Inner />
    </form>
  );
}
