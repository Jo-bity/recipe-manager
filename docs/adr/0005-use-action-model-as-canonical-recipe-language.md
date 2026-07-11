# Use Steps with Nested Actions as Canonical Recipe Language

Recipes should use Step and Step List as the canonical public language for recipe authoring. A Step is the technician-facing unit described by the case study; each Step contains one or more ordered atomic Actions. The MVP creates one Action per Step for simplicity, while preserving the nested model for future compound Steps.

Recipe JSON should optimize for human-readable procedure intent before adapter convenience. The public contract is `steps`, and each Step contains an `actions` array with Action envelopes such as Take Image and Unscrewing. Robot Adapters may flatten Step Actions into vendor-specific command plans, but vendor-specific command fields should not leak into the Recipe authoring model.

Validation is split into three levels: the Recipe validates ordered Steps, the Step validates that it contains at least one ordered Action, and each Action type validates its own parameter schema. This keeps the authoring model aligned with the assignment while retaining a focused Action abstraction for robot intent and adapter translation.
