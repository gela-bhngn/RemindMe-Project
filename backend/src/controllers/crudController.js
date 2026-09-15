import {
  addToUserCollection,
  deleteUserCollectionItem,
  getUserCollection,
  updateUserCollectionItem
} from "../services/databaseService.js";

export function createCrudController(collection) {
  return {
    async list(req, res, next) {
      try {
        res.json(await getUserCollection(req.user, collection));
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        res.status(201).json(await addToUserCollection(req.user, collection, req.body));
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const record = await updateUserCollectionItem(req.user, collection, req.params.id, req.body);
        if (!record) return res.status(404).json({ message: "Record not found" });
        return res.json(record);
      } catch (error) {
        return next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const deleted = await deleteUserCollectionItem(req.user, collection, req.params.id);
        if (!deleted) return res.status(404).json({ message: "Record not found" });
        return res.status(204).end();
      } catch (error) {
        return next(error);
      }
    }
  };
}
