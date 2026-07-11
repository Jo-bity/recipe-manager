# Use Steps with Nested Actions as Canonical Recipe Language

Recipes should use Step and Step List as the canonical public language for recipe authoring. A Step is the technician-facing unit described by the case study, so each Step has an explicit case-study `type` such as Take Image or Unscrewing. The MVP enforces exactly one Action per Step and requires the Step type to match that Action type, while preserving the nested Action model for future compound Steps.

Recipe JSON should optimize for human-readable procedure intent before adapter convenience. The public contract is `steps`, and each Step contains a `type` plus an `actions` array with the matching Action envelope. Robot Adapters may flatten Step Actions into vendor-specific command plans, but vendor-specific command fields should not leak into the Recipe authoring model.

Validation is split into three levels: the Recipe validates ordered Steps, the Step validates that it contains exactly one matching Action for the MVP, and each Action type validates its own parameter schema. This keeps the authoring model aligned with the assignment while retaining a focused Action abstraction for robot intent and adapter translation.
