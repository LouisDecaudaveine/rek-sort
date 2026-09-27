import { Router } from "express";
import { dispatch } from "../dispatch";

export const rpcRouter =  Router();


rpcRouter.post("/:name", async (req, res) => {
    const data = await dispatch(req.params.name, req.body ?? {});

    res.json({ok: true, data})
})