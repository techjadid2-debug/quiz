import { SetupForm } from "@/components/SetupForm";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Zakovatga tayyorlaning</h1>
        <p className="mt-3 text-base text-muted">
          Kategoriya va qiyinlikni tanlang — har bir javobdan so‘ng izoh va manba ko‘rsatiladi.
        </p>
      </header>
      <SetupForm />
    </div>
  );
}
