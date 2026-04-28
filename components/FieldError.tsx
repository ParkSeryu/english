export function FieldError({ messages, id }: { messages?: string[]; id?: string }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="mt-2 text-sm font-medium text-red-700">
      {messages.join(" ")}
    </p>
  );
}
