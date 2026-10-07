import { loadExercises } from "../../utils/strengthStore";

export default defineEventHandler(async () => ({ exercises: await loadExercises() }));
