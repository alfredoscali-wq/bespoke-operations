type EntityActionFeedbackProps = {
  message: string | null
  variant?: "success" | "error"
}

export function EntityActionFeedback({
  message,
  variant = "success",
}: EntityActionFeedbackProps) {
  if (!message) return null

  return (
    <p
      className={
        variant === "success"
          ? "text-sm text-emerald-700"
          : "text-sm text-destructive"
      }
      role="status"
    >
      {message}
    </p>
  )
}
