import * as React from "react";

import { cn } from "@/lib/utils";

type AuthHeadingProps = {
  title: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function AuthHeading({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
}: AuthHeadingProps) {
  return (
    <div className={cn("mb-8 text-center", className)}>
      <h1 className={cn("featured-auth-heading", titleClassName)}>
        <span aria-hidden className="featured-auth-heading__glow">
          {title}
        </span>
        <span className="relative">{title}</span>
      </h1>
      {subtitle ? (
        <p className={cn("mt-3 text-white/60", subtitleClassName)}>{subtitle}</p>
      ) : null}
    </div>
  );
}
