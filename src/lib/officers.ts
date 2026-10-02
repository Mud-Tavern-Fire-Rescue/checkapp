// Department leadership, in chain-of-command order. Display-only for now;
// sign-in access is controlled by User.role in the database.
export const OFFICERS = [
  { name: "Richard Ennis", title: "Chief" },
  { name: "Brandon Adams", title: "Deputy" },
  { name: "Andrew Joseph", title: "Fire Captain" },
  { name: "Mike Russell", title: "EMS Captain" },
] as const;
