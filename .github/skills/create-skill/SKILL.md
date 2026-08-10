---
name: create-skill
user-invocable: true
description: "Workspace skill to guide creating a new SKILL.md file for agent customization in this repository."
---

# Create Skill

## Purpose

This skill helps you create a `SKILL.md` file for workspace-scoped agent customizations. It documents the exact workflow for deciding where to place the skill, what frontmatter is needed, and how to validate the file so it works correctly in the current repository.

## When to Use

- When you want to add a new workspace skill under this repo.
- When you need a reusable workflow for creating `SKILL.md` files.
- When you want to ensure the skill is authored with the right frontmatter and location.

## Workflow

1. Confirm the target scope
   - Workspace-scoped: save under `.github/skills/<name>/SKILL.md`
   - User-scoped: save under `{{VSCODE_USER_PROMPTS_FOLDER}}/<name>/SKILL.md`

2. Choose a descriptive skill name
   - Use a short, lowercase hyphenated identifier like `create-skill`
   - Keep `name:` consistent with the skill folder name

3. Write the frontmatter
   - Required fields:
     - `name`
     - `user-invocable`
     - `description`
   - Example:
     ```yaml
     ---
     name: create-skill
     user-invocable: true
     description: "Workspace skill to guide creating a new SKILL.md file for agent customization in this repository."
     ---
     ```

4. Document the decision logic
   - Explain when to use a skill versus instructions, prompts, or custom agents.
   - Include the main decision points and branching logic for this repo.
   - Record quality criteria and completion checks.

5. Add a validation checklist
   - Verify the file path is correct
   - Confirm YAML syntax is valid
   - Confirm the description is clear and contains trigger phrases
   - Confirm the skill name matches the folder name

6. Save the file
   - Create the skill at the chosen path
   - Use repository or user settings depending on scope

## Quality Criteria

- Frontmatter is valid YAML
- `name` matches the folder name
- `description` is specific and actionable
- The skill is stored under `.github/skills/<name>/SKILL.md` for workspace use
- The body explains the workflow clearly and includes completion checks

## Example Prompts

- `Create a new SKILL.md for repo-specific agent customization.`
- `Guide me through writing a workspace skill file for a new workflow.`
- `Help me author and validate SKILL.md frontmatter in this repository.`

## Next Customizations

- Create a matching `.github/prompts/create-skill.prompt.md` for single-step prompt guidance.
- Add a `.github/agents/create-skill.agent.md` if you want a custom agent with restricted tools.
- Add `applyTo` instructions in `.github/instructions/` for related file-specific guidance.
