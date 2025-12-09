import express from 'express';
import prisma from './prisma';
import { userRouter } from "./user/user.routes";
import { authRouter } from './auth/auth.routes';
import { meRouter } from './me/me.routes';
import { exerciseRouter } from './exercises/exercise.routes';
import { workoutRouter } from './workout/workout.routes';
import cors from 'cors';

// create instance of express
const app = express();

// middleware for parsing json bodies
app.use(express.json());

// use routers
app.use("/user", userRouter);
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/exercises", exerciseRouter);
app.use("/workout", workoutRouter);

// cors configuration
app.use(cors({
  origin: "https://progresspoint.vercel.app/", // frontend url
  credentials: true
}));

// health check route
app.get('/', (req, res) => {
    res.send('Server is running');
});

export { app };