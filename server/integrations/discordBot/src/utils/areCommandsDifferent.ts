/**
 * Purpose
 * Provide the are commands different logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// Checks if two commands are different

interface CommandChoice {
  name: string
  value: any
}

interface Command {
  choices?: CommandChoice[]
  [key: string]: any
}

// Define areCommandsDifferent for the steps below.
const areCommandsDifferent = (existingCommand: Command, localCommand: Command): boolean => {
  // Define areChoicesDifferent for the steps below.
  const areChoicesDifferent = (
    existingChoices: CommandChoice[] = [],
    localChoices: CommandChoice[] = []
  ): boolean => {
    // Repeat the following steps for each item in localChoices.
    for (const localChoice of localChoices) {
      // Use existingChoices.find to initialize existingChoice.
      const existingChoice = existingChoices.find((choice) => choice.name === localChoice.name)

      // Check whether !existingChoice before running this branch.
      if (!existingChoice) {
        // Pass true back to the caller.
        return true
      }

      // Check whether localChoice.value !== existingChoice.value before running this branch.
      if (localChoice.value !== existingChoice.value) {
        // Pass true back to the caller.
        return true
      }
    }
    // Pass false back to the caller.
    return false
  }

  // Add additional checks for other properties of the commands if needed
  // Example:
  // if (existingCommand.name !== localCommand.name) {
  //   return true;
  // }

  return areChoicesDifferent(existingCommand.choices, localCommand.choices)
}

export default areCommandsDifferent
