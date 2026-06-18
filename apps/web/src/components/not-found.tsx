import notFoundImage from "@/assets/images/error.404.png";

type FeedbackScope = "inline" | "page";

interface NotFoundDisplayProps {
  heading?: string;
  message?: string;
  scope?: FeedbackScope;
}

type NotFoundProps = NotFoundDisplayProps & Record<string, unknown>;

export function NotFound({
  heading = "Page not found",
  message = "Oops! Page Not Found.",
  scope = "page",
}: NotFoundProps) {
  const content = (
    <s-section heading={scope === "inline" ? heading : undefined}>
      <s-stack alignItems="center">
        <s-box inlineSize="400px">
          <s-image
            src={notFoundImage}
            alt="Page not found"
            aspectRatio="1/1"
            objectFit="contain"
            inlineSize="fill"
            loading="lazy"
          ></s-image>
        </s-box>
      </s-stack>
      <s-text color="subdued">{message}</s-text>
      <s-link href="/">Go to app home</s-link>
    </s-section>
  );

  if (scope === "page") {
    return (
      <s-page heading={heading} inlineSize="base">
        {content}
      </s-page>
    );
  }

  return content;
}
