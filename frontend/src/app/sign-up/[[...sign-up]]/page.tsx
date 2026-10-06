import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { CardioSenseLogo } from "../../components/CardioSenseLogo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <CardioSenseLogo className="h-11 w-11 shrink-0" variant="badge" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-[0.16em] text-slate-900 leading-none">
                CARDIOSENSE
              </span>
              <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700 uppercase tracking-wide">
                Clinical AI
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Explainable ECG Intelligence
            </p>
          </div>
        </Link>

        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Create your CardioSense account
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Secure access to your ECG analysis history.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md flex justify-center px-4">
        <SignUp
          appearance={{
            elements: {
              card: "shadow-sm border border-slate-200 rounded-2xl bg-white",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              formButtonPrimary:
                "bg-red-600 hover:bg-red-700 text-sm font-semibold transition-colors",
              footerActionLink: "text-red-700 hover:text-red-800 font-semibold",
            },
          }}
        />
      </div>
    </div>
  );
}
