import AuthForm from "../../components/AuthForm";
export const metadata = { title: "Créer un compte" };
export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
