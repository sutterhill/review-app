import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface CommentMarkdownProps {
  body: string;
  className?: string;
}

const MARKDOWN_COMPONENTS: Components = {
  a: ({ children, href }) => (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
};

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "sub", "sup", "details", "summary"],
};

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS: React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [
  rehypeRaw,
  [rehypeSanitize, SANITIZE_SCHEMA],
];

export const CommentMarkdown = ({ body, className }: CommentMarkdownProps): React.JSX.Element => (
  <div
    className={cn(
      "break-words text-[0.85rem] leading-relaxed text-foreground",
      "[&_p]:my-0 [&_p+p]:mt-2",
      "[&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground/80",
      "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.78rem]",
      "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2",
      "[&_pre>code]:bg-transparent [&_pre>code]:p-0",
      "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
      "[&_li]:my-0.5",
      "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground",
      "[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-[0.95rem] [&_h1]:font-semibold",
      "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-[0.9rem] [&_h2]:font-semibold",
      "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-[0.85rem] [&_h3]:font-semibold",
      "[&_table]:my-2 [&_table]:border-collapse",
      "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
      "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
      "[&_hr]:my-2 [&_hr]:border-border",
      "[&_sub]:text-[0.72rem] [&_sub]:text-muted-foreground",
      "[&_sup]:text-[0.72rem] [&_sup]:text-muted-foreground",
      "[&_details]:my-2 [&_details]:rounded [&_details]:border [&_details]:border-border [&_details]:px-2 [&_details]:py-1",
      "[&_summary]:cursor-pointer [&_summary]:text-muted-foreground",
      className,
    )}
  >
    <ReactMarkdown
      components={MARKDOWN_COMPONENTS}
      rehypePlugins={REHYPE_PLUGINS}
      remarkPlugins={REMARK_PLUGINS}
    >
      {body}
    </ReactMarkdown>
  </div>
);
