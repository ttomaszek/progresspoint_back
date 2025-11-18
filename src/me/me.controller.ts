import { Request, Response } from "express";
import prisma from "../prisma";
import { computeStreakFromWorkouts, uniqueSortedDateKeys } from "./utils";

export const me = async (req: Request, res: Response) => {
    try {
        const userId = req.user;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // user info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                createdAt: true
            },
        });

        // full workouts with duration + nested structure
        const workouts = await prisma.workout.findMany({
            where: { userId },
            select: {
                id: true,
                startedAt: true,
                durationMinutes: true,
                workoutExercises: {
                    select: {
                        exerciseId: true,
                        sets: {
                            select: {
                                repetitions: true,
                                weight: true
                            }
                        }
                    }
                }
            },
            orderBy: { startedAt: "desc" }
        });

        // total workouts
        const totalWorkouts = workouts.length;

        // streak logic as before
        const streakWorkoutsLite = workouts.map(w => ({ startedAt: w.startedAt }));
        const currentStreak = computeStreakFromWorkouts(streakWorkoutsLite);

        const days = uniqueSortedDateKeys(streakWorkoutsLite);
        const lastWorkoutDate = days[0] || null;

        // === NEW STATS ===

        // total duration
        const totalDuration = workouts.reduce(
            (acc, w) => acc + (w.durationMinutes ?? 0),
            0
        );

        // unique exercises used
        const exerciseIds = new Set<string>();
        workouts.forEach(w => {
            w.workoutExercises.forEach(we => exerciseIds.add(we.exerciseId));
        });
        const totalExercisesUsed = exerciseIds.size;

        // total sets + reps + volume
        let totalSets = 0;
        let totalReps = 0;
        let totalVolume = 0;

        workouts.forEach(w => {
            w.workoutExercises.forEach(we => {
                totalSets += we.sets.length;
                we.sets.forEach(s => {
                    totalReps += s.repetitions;
                    totalVolume += s.repetitions * s.weight;
                });
            });
        });

        return res.json({
            user,
            totalWorkouts,
            currentStreak,
            days,
            lastWorkoutDate,

            // new stats
            totalDuration,
            totalExercisesUsed,
            totalSets,
            totalReps,
            totalVolume
        });

    } catch (err) {
        console.error("Error fetching user profile:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};
