import AuthForm from "../../components/AuthForm";
export const metadata = { title: "Sign in", alternates: { canonical: "/login" } };
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
