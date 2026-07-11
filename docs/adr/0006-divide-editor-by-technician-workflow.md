# Divide Editor by Technician Workflow

The Recipe Editor should be divided into Setup, Step Configuration, and Step List rather than exposing all controls in one form. This matches how a Robotics Technician reasons about the job: first define the operational purpose, then choose a Step type and configure the draft Step, then add the configured Step to the ordered sequence.

Step List is intentionally the result panel, not the Step creation control. Clicking a Step type opens the respective Step Configuration draft; the Recipe changes only when the technician clicks Add configured step. Recipe JSON and Adapter Preview remain secondary surfaces because they support exchange and integration review, not the primary authoring flow.
