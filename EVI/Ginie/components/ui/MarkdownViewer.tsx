"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function MarkdownViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={"markdown-viewer text-white/90 text-[13.5px] leading-[1.7] " + (className || "") }>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }: { children?: React.ReactNode }) {
            return <div className="my-3">{children}</div>;
          },
          h1({ children }: { children?: React.ReactNode }) {
            return (
              <h1 className="mt-6 mb-3 text-2xl md:text-3xl font-semibold tracking-tight text-white">
                {children}
              </h1>
            );
          },
          h2({ children }: { children?: React.ReactNode }) {
            return (
              <h2 className="mt-6 mb-2 text-xl md:text-2xl font-semibold tracking-tight text-white">
                {children}
              </h2>
            );
          },
          h3({ children }: { children?: React.ReactNode }) {
            return (
              <h3 className="mt-5 mb-2 text-lg font-semibold text-white">
                {children}
              </h3>
            );
          },
          h4({ children }: { children?: React.ReactNode }) {
            return (
              <h4 className="mt-4 mb-2 text-base font-semibold text-white">
                {children}
              </h4>
            );
          },
          p({ children }: { children?: React.ReactNode }) {
            const kids = React.Children.toArray(children as any);
            const only = kids.length === 1 ? (kids[0] as any) : null;
            const cls = only && only.props ? String(only.props.className || "") : "";
            if (only && cls.includes("language-")) {
              return <div className="my-3">{children}</div>;
            }
            return <p className="my-3 text-white/85">{children}</p>;
          },
          ul({ children }: { children?: React.ReactNode }) {
            return <ul className="my-3 ml-6 list-disc text-white/85 space-y-1">{children}</ul>;
          },
          ol({ children }: { children?: React.ReactNode }) {
            return <ol className="my-3 ml-6 list-decimal text-white/85 space-y-1">{children}</ol>;
          },
          li({ children }: { children?: React.ReactNode }) {
            return <li className="my-1">{children}</li>;
          },
          hr() {
            return <hr className="my-6 border-white/10" />;
          },
          blockquote({ children }: { children?: React.ReactNode }) {
            return (
              <blockquote className="my-4 border-l-2 border-white/20 pl-4 text-white/75">
                {children}
              </blockquote>
            );
          },
          strong({ children }: { children?: React.ReactNode }) {
            return <strong className="text-white font-semibold">{children}</strong>;
          },
          em({ children }: { children?: React.ReactNode }) {
            return <em className="italic text-white/90">{children}</em>;
          },
          code(props: any) {
            const { inline, className, children, ...rest } = props || {};
            const match = /language-(\w+)/.exec(className || "");
            const text = String(children).replace(/\n$/, "");
            const isInline = inline !== false && !match && !text.includes("\n");
            if (!isInline) {
              return (
                <SyntaxHighlighter
                  style={vscDarkPlus as any}
                  language={(match && match[1]) || ""}
                  PreTag="pre"
                  customStyle={{
                    margin: 0,
                    background: "#0b0b0b",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                  {...rest}
                >
                  {text}
                </SyntaxHighlighter>
              );
            }
            return (
              <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]" {...rest}>
                {children}
              </code>
            );
          },
          a({ href, children, ...rest }: { href?: string; children?: React.ReactNode; [key: string]: any }) {
            return (
              <a href={href as any} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline" {...(rest as any)}>
                {children}
              </a>
            );
          },
          table({ children }: { children?: React.ReactNode }) {
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">{children}</table>
              </div>
            );
          },
          th({ children }: { children?: React.ReactNode }) {
            return (
              <th className="border-b border-white/10 px-3 py-2 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }: { children?: React.ReactNode }) {
            return (
              <td className="border-b border-white/5 px-3 py-2 align-top">{children}</td>
            );
          },
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}
