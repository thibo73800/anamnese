-- Ajoute une colonne `explanation` nullable sur public.cards.
-- Contient la version markdown détaillée du thème au moment de la création
-- (potentiellement enrichie par des questions de clarification).
-- Affichée à la demande pendant les révisions via un bouton "info".

alter table public.cards
  add column if not exists explanation text;
