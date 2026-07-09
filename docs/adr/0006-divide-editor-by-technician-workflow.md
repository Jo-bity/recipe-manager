# Divide Editor by Technician Workflow

The Recipe Editor should be divided into Setup, Action List, and Action Configuration rather than exposing all controls in one form. This matches how a Robotics Technician reasons about the job: first define the operational purpose, then order the robot procedure, then tune the selected Action's parameters. Recipe JSON and Adapter Preview remain secondary surfaces because they support exchange and integration review, not the primary authoring flow.
