export default function BoutonFicheTechnique({ children = "Fiche technique", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props}>{children}</button>;
}
