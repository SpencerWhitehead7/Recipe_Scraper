import { expect } from "chai";
import * as request from "supertest";
import {
  syncDB,
  app,
  connection,
  factoryRecipe,
  factoryTag,
  userCred,
  user2Cred,
} from "../../mochaSetup";
import { Recipe, User } from "../../db/entities";

describe("API Route Recipe: /api/recipe", () => {
  const route = "/api/recipe";
  let agent: any;
  let user: User;

  beforeEach(async () => {
    try {
      await syncDB();
      agent = request.agent(app);
      await agent.post("/api/auth/signup").send(userCred);
      user = await connection.manager.findOneOrFail(User, 1);
    } catch (err) {
      console.log(err);
    }
  });
  afterEach(async () => {
    try {
      await Promise.all([agent.post("/api/auth/logout")]);
      await syncDB();
    } catch (err) {
      console.log(err);
    }
  });

  describe("/", () => {
    describe("GET", () => {
      it("returns all recipes, including tags", async () => {
        const recipe = await connection.manager.save(factoryRecipe({ user }));
        await connection.manager.save(factoryTag({ recipes: [recipe] }));

        const res = await request(app).get(route);
        expect(res.status).to.equal(200);
        expect(res.body.length).to.equal(1);
        expect(res.body[0].tags).to.exist;
      });
    });

    describe("POST", () => {
      it("creates a recipe", async () => {
        await agent.post(route).send(factoryRecipe());
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);
        expect(recipe).to.exist;
      });
      it("rejects unauthenticated users' attempts", async () => {
        const failedRes = await request(app).post(route).send(factoryRecipe());
        const recipe = await connection.manager.findOne(Recipe, 1);
        expect(failedRes.status).to.equal(401);
        expect(failedRes.text).to.equal("Not logged in");
        expect(recipe).not.to.exist;
      });
      it("sets createdBy to the user's ID, even with bad input", async () => {
        await agent.post(route).send(factoryRecipe({ createdBy: 2 }));
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);
        expect(recipe.createdBy).to.equal(1);
      });
      it("ensures forkedCount will use default value of 0, even with bad input", async () => {
        await agent.post(route).send(factoryRecipe({ forkedCount: 2 }));
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);
        expect(recipe.forkedCount).to.equal(0);
      });
      it("sets the recipe's owner to the creator", async () => {
        await agent.post(route).send(factoryRecipe());
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);
        expect(recipe.userId).to.equal(1);
      });
      it("returns the recipe", async () => {
        const res = await agent.post(route).send(factoryRecipe());
        expect(res.status).to.equal(200);
        expect(res.body.id).to.equal(1);
        expect(res.body.text).to.equal("text");
        expect(res.body.title).to.equal("title");
        expect(res.body.sourceSite).to.equal("upload");
        expect(res.body.sourceUrl).to.equal("upload");
        expect(res.body.createdBy).to.equal(1);
        expect(res.body.forkedCount).to.equal(0);
      });
    });
  });

  describe("/byid", () => {
    describe("GET", () => {
      it("returns the recipe with the matching ID, including tags", async () => {
        await connection.manager.save(factoryRecipe({ user }));

        const res = await request(app).get(`${route}/byid/1`);
        expect(res.status).to.equal(200);
        expect(res.body.id).to.equal(1);
        expect(res.body.tags).to.exist;
      });
    });
  });

  describe("/bytag?", () => {
    beforeEach(async () => {
      try {
        const [recipe1, recipe2] = await Promise.all(
          [factoryRecipe({ user }), factoryRecipe({ user })].map((row) =>
            connection.manager.save(row)
          )
        );
        await Promise.all(
          [
            factoryTag({ name: "tone", recipes: [recipe1, recipe2] }),
            factoryTag({ name: "ttwo", recipes: [recipe1] }),
          ].map((row) => connection.manager.save(row))
        );
      } catch (err) {
        console.log(err);
      }
    });

    describe("GET", () => {
      it("returns all recipes which have a tag that matches a queried tag", async () => {
        const res = await request(app).get(`${route}/bytag?0=tone`);
        expect(res.status).to.equal(200);
        expect(res.body.length).to.equal(2);
        expect(new Set(res.body.map(({ id }: Recipe) => id))).to.deep.equal(
          new Set([1, 2])
        );
      });
      it("does not return any duplicate recipes", async () => {
        const res = await request(app).get(`${route}/bytag?0=tone&1=ttwo`);
        expect(res.status).to.equal(200);
        expect(res.body.length).to.equal(2);
        expect(res.body[0].id).not.to.equal(res.body[1].id);
      });
      it("handles searching for tags that do not exist", async () => {
        const res = await request(app).get(`${route}/bytag?0=nonexistant`);
        expect(res.status).to.equal(200);
        expect(res.body).to.be.empty;
      });
    });
  });

  describe("/fork/:id", () => {
    describe("POST", () => {
      let agent2: any;
      beforeEach(async () => {
        agent2 = request.agent(app);
        await agent2.post("/api/auth/signup").send(user2Cred);
        await agent.post(route).send(factoryRecipe());
      });
      afterEach(async () => {
        agent2.post("api/auth/logout");
      });

      it("makes a copy of the recipe and saves it to the user's account", async () => {
        await agent2.post(`${route}/fork/1`);
        const user2 = await connection.manager.findOneOrFail(User, 2, {
          relations: ["recipes"],
        });
        expect(user2.recipes.length).to.equal(1);
        expect(user2.recipes[0].createdBy).to.equal(1);
      });
      it("the copy inherits the original's tags", async () => {
        await agent2.post(`${route}/fork/1`);
        const original = await connection.manager.findOneOrFail(Recipe, 1, {
          relations: ["tags"],
        });
        await connection.manager.save(
          factoryTag({ name: "tone", recipes: [original] })
        );
        const copy = await connection.manager.findOneOrFail(Recipe, 2, {
          relations: ["tags"],
        });
        expect(original.tags).to.deep.equal(copy.tags);
      });
      it("rejects unauthenticated users", async () => {
        const failedRes = await request(app).post(`${route}/fork/1`);
        expect(failedRes.status).to.equal(401);
        expect(failedRes.text).to.equal("Not logged in");
      });
      it("rejects attempts to fork non-existant recipes", async () => {
        const failedRes = await agent2.post(`${route}/fork/100`);
        expect(failedRes.status).to.equal(404);
        expect(failedRes.text).to.equal("Recipe not found");
      });
      it("if the user is not the recipe's creator, it increments the recipe's forkedCount", async () => {
        await agent2.post(`${route}/fork/1`);
        const original = await connection.manager.findOneOrFail(Recipe, 1);
        const copy = await connection.manager.findOneOrFail(Recipe, 2);
        expect(original.forkedCount).to.equal(1);
        expect(copy.forkedCount).to.equal(0);
      });
      it("if the user is the recipe's creator, it does not increment the recipe's forkedCount", async () => {
        await agent.post(`${route}/fork/1`);
        const original = await connection.manager.findOneOrFail(Recipe, 1);
        const copy = await connection.manager.findOneOrFail(Recipe, 2);
        expect(original.forkedCount).to.equal(0);
        expect(copy.forkedCount).to.equal(0);
      });
    });
  });

  describe("/:id", () => {
    describe("PUT", () => {
      it("edits a recipe", async () => {
        await agent.post(route).send(factoryRecipe());
        await agent
          .put(`${route}/1`)
          .send({ text: "newText", title: "newTitle" });
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);

        expect(recipe.text).to.equal("newText");
        expect(recipe.title).to.equal("newTitle");
      });
      it("rejects unauthenticated users' attempts", async () => {
        await agent.post(route).send(factoryRecipe());
        const recipeBefore = await connection.manager.findOneOrFail(Recipe, 1);
        const failedRes = await request(app)
          .put(`${route}/1`)
          .send({ text: "failedText", title: "failedTitle" });
        const recipeAfter = await connection.manager.findOneOrFail(Recipe, 1);

        expect(failedRes.status).to.equal(401);
        expect(failedRes.text).to.equal("Not logged in");
        expect(recipeBefore).to.deep.equal(recipeAfter);
      });
      it("rejects attempts to edit a recipe the user does not own", async () => {
        await agent.post(route).send(factoryRecipe());
        const agent2 = request.agent(app);
        await agent2.post("/api/auth/signup").send(user2Cred);
        const recipeBefore = await connection.manager.findOneOrFail(Recipe, 1);
        const failedRes = await agent2
          .put(`${route}/1`)
          .send({ text: "failedText", title: "failedTitle" });
        const recipeAfter = await connection.manager.findOneOrFail(Recipe, 1);

        expect(failedRes.status).to.equal(401);
        expect(failedRes.text).to.equal("Permission denied");
        expect(recipeBefore).to.deep.equal(recipeAfter);
      });
      it("allows users to edit only text and title, even if they attempt to edit other fields", async () => {
        await agent.post(route).send(factoryRecipe());
        const recipeBefore = await connection.manager.findOneOrFail(Recipe, 1);
        await agent.put(`${route}/1`).send({
          id: 10,
          text: "newText",
          title: "newTitle",
          sourceSite: "new site",
          sourceUrl: "new url",
          createdBy: 10,
          forkedCount: 10,
          userId: 10,
        });
        const recipeAfter = await connection.manager.findOneOrFail(Recipe, 1);

        expect(recipeAfter.text).to.equal("newText");
        expect(recipeAfter.title).to.equal("newTitle");
        expect(recipeBefore.text).not.to.equal(recipeAfter.text);
        expect(recipeBefore.id).to.equal(recipeAfter.id);
        expect(recipeBefore.sourceSite).to.equal(recipeAfter.sourceSite);
        expect(recipeBefore.sourceUrl).to.equal(recipeAfter.sourceUrl);
        expect(recipeBefore.createdBy).to.equal(recipeAfter.createdBy);
        expect(recipeBefore.forkedCount).to.equal(recipeAfter.forkedCount);
      });
      it("returns the recipe, including tags", async () => {
        await agent.post(route).send(factoryRecipe());
        const res = await agent
          .put(`${route}/1`)
          .send({ text: "newText", title: "newTitle" });

        expect(res.status).to.equal(200);
        expect(res.body.id).to.equal(1);
        expect(res.body.text).to.equal("newText");
        expect(res.body.title).to.equal("newTitle");
        expect(res.body.sourceSite).to.equal("upload");
        expect(res.body.sourceUrl).to.equal("upload");
        expect(res.body.createdBy).to.equal(1);
        expect(res.body.forkedCount).to.equal(0);
        expect(res.body.tags).to.exist;
      });
    });

    describe("DELETE", () => {
      it("deletes a recipe", async () => {
        await agent.post(route).send(factoryRecipe());
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);

        const res = await agent.delete(`${route}/1`);
        const noRecipe = await connection.manager.findOne(Recipe, 1);
        expect(res.status).to.equal(200);
        expect(recipe).to.exist;
        expect(noRecipe).not.to.exist;
      });
      it("rejects unauthenticated users' attempts", async () => {
        await agent.post(route).send(factoryRecipe());

        const failedRes = await request(app).delete(`${route}/1`);
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);
        expect(failedRes.status).to.equal(401);
        expect(failedRes.text).to.equal("Not logged in");
        expect(recipe).to.exist;
      });
      it("rejects attempts to edit a recipe the user does not own", async () => {
        await agent.post(route).send(factoryRecipe());
        const agent2 = request.agent(app);
        await agent2.post("/api/auth/signup").send(user2Cred);

        const failedRes = await agent2.delete(`${route}/1`);
        const recipe = await connection.manager.findOneOrFail(Recipe, 1);

        agent2.post("/api/auth/logout");

        expect(failedRes.status).to.equal(401);
        expect(failedRes.text).to.equal("Permission denied");
        expect(recipe).not.to.be.a("null");
      });
    });
  });
});