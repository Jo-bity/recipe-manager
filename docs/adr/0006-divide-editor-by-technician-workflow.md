# Divide Editor by Technician Workflow

The Recipe Editor should be divided into Setup, Add Step, Step Configuration, and Step List rather than exposing all controls in one form. This matches how a Robotics Technician reasons about the job: first define the operational purpose, then explicitly add a Step type, then tune the selected Step's Action parameters, then review and reorder the resulting Step sequence.

Step List is intentionally the result panel, not the Step creation control. Clicking a Step type only selects the type; the Recipe changes only when the technician clicks Add Step. Recipe JSON and Adapter Preview remain secondary surfaces because they support exchange and integration review, not the primary authoring flow.
