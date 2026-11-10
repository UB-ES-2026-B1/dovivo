Tasca: #<!-- subtasca --> · Història: #<!-- US -->

<!-- Títol: `<tipus>: <descripció en català> (US-xx | T-xx)`. Base: `development`. -->

## Resum

<!-- Què fa aquest PR i per què, en 2-3 frases. -->

## Canvis

- `ruta/al/fitxer`: què canvia

## Criteris d'acceptació

<!-- Copiats de la subtasca i de la història. Marca només el que lliura aquest PR i has comprovat, i digues com. La resta, sense marcar i amb el motiu o la issue que ho cobreix. -->

- [ ] **Criteri** — com s'ha comprovat

## Pendents / notes

<!-- Limitacions, feina pendent, decisions que el revisor ha de conèixer. Si no n'hi ha, «—». -->

## Verificació

- [ ] `pnpm format:check`, `pnpm check`, `pnpm test`
- [ ] Prova manual contra `pnpm dev` (si toca la UI o un flux)

## Revisió

<!-- Per al revisor: no les marquis tu. -->

- [ ] El codi fa el que diu el resum i compleix els criteris marcats
- [ ] Hi ha tests per a la lògica nova i comproven el que diuen
- [ ] Segueix `AGENTS.md`: sense `any`, inputs validats amb zod, `protectedProcedure` i propietat comprovada
- [ ] CI en verd
