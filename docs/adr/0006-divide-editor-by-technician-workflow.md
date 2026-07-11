# Divide Editor by Technician Workflow

The Recipe Editor should be divided into Setup, Step List, and Step Configuration rather than exposing all controls in one form. This matches how a Robotics Technician reasons about the job: first define the operational purpose, then order the robot procedure as Steps, then tune the selected Step's Action parameters. Recipe JSON and Adapter Preview remain secondary surfaces because they support exchange and integration review, not the primary authoring flow.
