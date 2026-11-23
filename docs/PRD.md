# SafeSend PRD

> Draft. The full PRD (journeys, requirements, non-goals, success metrics, experiment design) is
> written in the "ship the demo" slice. This file currently holds the sections already decided.

## Persona

**Daniela, 52, Santa Cruz, Bolivia.** During the dollar shortage she started holding USDC. Her son
Mateo sends her USDC from Kansas. She sends some to her sister Lucía, pays rent, and takes part in a
pasanaku with friends. She is careful but not technical: she copies addresses from her wallet
history because it's easier than finding the original message.

## Pasanaku: recurring payments to new people

**Context.** A pasanaku is a rotating savings group common in Bolivia. Each member contributes every
month, and each month one member receives the pot. With USDC, Daniela sends 50 USDC to a
different member each month, often someone she has never paid before. The addresses are shared in
the group's chat.

**Problem.** SafeSend treats a first send to a new address above 25 USDC as risky. It asks for the
strongest confirmation: typing 4 characters from the middle of the address. For a pasanaku that
means the hardest friction every single month, for a payment that is entirely normal. Friction that
fires on routine behavior trains people to click through it, and that is exactly when it fails
against a real attack.

**Options considered.**

| Option                           | Effect on pasanaku            | Effect on everyone else                | Decision         |
| -------------------------------- | ----------------------------- | -------------------------------------- | ---------------- |
| Raise the first-send threshold   | Less friction                 | Weaker protection for every first send | Rejected         |
| Skip checks for "small" amounts  | Less friction                 | Attackers adapt: many small thefts     | Rejected         |
| **Group contacts** ("Add group") | One careful setup, then ALLOW | None: rules for strangers unchanged    | **Chosen** (D18) |

**Requirements.**

1. The user can create a named group (for example "Pasanaku Mayo") and add several members in one
   flow.
2. Every member is added with the same rules as a single contact: the full address is entered,
   never picked from history, and the user explicitly confirms they got it from the member.
3. A member whose address looks like someone already protected, **or like another member of the
   same group**, needs the address typed twice and a confirmation that it was checked through
   another channel, like a phone call.
4. The same address can't be added twice.
5. After saving, members are ordinary contacts with a group label. Paying them is a contact payment
   (ALLOW, unless another signal such as an unusual amount applies).
6. Grouping never grants extra trust and never relaxes BLOCK.

**Success metrics (for a real launch; not measured in this prototype).**

- **Repeat-confirmation rate for group members:** the share of monthly group payments that still
  hit a middle-character WARN. Target: near zero after setup.
- **Group setup completion rate and time to complete:** the setup is deliberately careful, so watch
  for abandonment.
- **Lookalike interception for group members:** lookalikes of group members should still BLOCK
  when planted.
- **Guardrail:** no increase in successful lookalike sends among users who created groups.

**Open questions.** Group membership changes every round (members rotate or leave): should SafeSend
suggest removing old members? Should a group be shareable, for example as a signed list from the
organizer? Sharing it would add a new trust channel, which needs its own threat model.
