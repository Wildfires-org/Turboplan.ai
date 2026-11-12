import { BrandHeader } from "@/components/brand-mark";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-dvh w-full bg-brandAlt-100">
      <BrandHeader />

      {/* Centered card */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="glass-card relative w-full max-w-[456px] rounded-[24px] p-7 sm:p-9">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
