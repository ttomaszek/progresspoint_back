import { Request, Response } from "express"
import prisma from "../prisma"

// define the shape of the request body
// startedAt is now handled by backend (uses current timestamp)

interface CreateWorkoutBody {
    durationMinutes: number;
    note?: string;
    exercises: {
        exerciseId: string;
        order: number;
        sets: {
            setNumber: number;
            repetitions: number;
            weight: number;
        }[];
    }[];
}

interface GetWorkoutsQuery {
  page?: string;
  limit?: string;
}

export const createWorkout = async (req: Request, res: Response) => {
    try {
        // check if theres a user id
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized"})
        }
        // get user id
        const userId = req.user;
        // get data from request body
        const { durationMinutes, note, exercises}: CreateWorkoutBody = req.body;
        // validation
        if (!durationMinutes || !exercises || exercises.length === 0) {
            return res.status(400).json({ message: "Missing required fields"});
        }
        // check if duration is not negative
        if (durationMinutes < 0) {
            return res.status(400).json({ message: "Duration must not be negative"})
        }
        // reps and weight must be non-negative
        for (const exercise of exercises) {
            for (const set of exercise.sets) {
                if (set.repetitions < 0 || set.weight < 0) {
                    return res.status(400).json({ message: "Repetitions and weight must not be negative"})
                }
            }
        }
        // verify that all exercises exists
        const exerciseIds = exercises.map(e => e.exerciseId);
        const existingExercises = await prisma.exercise.findMany({
            where: { id: {in: exerciseIds }},
            select: { id: true }
        });
        if (existingExercises.length !== exerciseIds.length) {
            return res.status(400).json({ message: "one or more exercises not found"})
        }
        // create workout with nested releations
        const workout = await prisma.workout.create({
            data:{
                userId,
                startedAt: new Date(), // Backend sets current timestamp
                durationMinutes,
                note: note,
                workoutExercises: {
                    create: exercises.map(exercise => ({
                        exerciseId: exercise.exerciseId,
                        order: exercise.order,
                        sets: {
                            create: exercise.sets.map(set => ({
                                setNumber: set.setNumber,
                                repetitions: set.repetitions,
                                weight: set.weight
                            }))
                        }
                    }))
                }
            },
            include: {
                workoutExercises: {
                    include: {
                        exercise: { select: { id: true, name: true}},
                        sets: true
                    }
                }
            }
        });
        return res.status(201).json(workout);
    } catch (err) {
        console.error("Failed to create workout", err);
        return res.status(500).json({ message: "Internal server error"})
    }
}

// get /workout?page=1&limit=10
export const getWorkout = async (req: Request, res: Response) => {
  try {
    // check if theres a user id
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user;

  // Parse pagination params with defaults (avoid || which swallows 0)
  const parsedPage = parseInt(req.query.page as string);
  const parsedLimit = parseInt(req.query.limit as string);
  const page = isNaN(parsedPage) ? 1 : parsedPage;
  const limit = isNaN(parsedLimit) ? 10 : parsedLimit;

    // Validate pagination params
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ message: "Page must be at least 1" });
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: "Limit must be between 1 and 100" });
    }

    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalWorkouts = await prisma.workout.count({
      where: { userId }
    });

    // Get paginated workouts
    const workouts = await prisma.workout.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, username: true } },
        workoutExercises: {
          include: {
            exercise: { select: { id: true, name: true, category: true } },
            sets: {
              orderBy: { setNumber: "asc" }
            }
          },
          orderBy: { order: "asc" }
        }
      },
      orderBy: { startedAt: "desc" }, // Most recent first
      skip,
      take: limit
    });

    const totalPages = Math.ceil(totalWorkouts / limit);

    return res.status(200).json({
      workouts,
      pagination: {
        currentPage: page,
        totalPages,
        totalWorkouts,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Failed to fetch workouts", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteWorkout = async (req: Request, res: Response) => {
  try {
    // check if theres a user id
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user;
    const { workoutId } = req.body;

    if (!workoutId) {
      return res.status(400).json({ message: "Missing workoutId in request body" });
    }

    // Verify that the workout exists and belongs to the user
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
    });

    if (!workout || workout.userId !== userId) {
      return res.status(404).json({ message: "Workout not found" });
    }

    // Delete the workout
    await prisma.workout.delete({
      where: { id: workoutId },
    });
    return res.status(200).json({ message: "Workout deleted successfully" });
  } catch (err) {
    console.error("Failed to delete workout", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};