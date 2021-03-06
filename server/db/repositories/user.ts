import {
  EntityRepository,
  AbstractRepository,
  getCustomRepository,
} from "typeorm";
import { User } from "../entities";

@EntityRepository(User)
class UserRepository extends AbstractRepository<User> {
  private select = () =>
    this.createQueryBuilder("user")
      .leftJoinAndSelect("user.recipes", "recipe")
      .leftJoinAndSelect("recipe.tags", "tag");

  private selectWithAuth = () =>
    this.select().addSelect("user.password");

  async insert(user: User) {
    const {
      raw: [createdUser],
    } = await this.createQueryBuilder("user")
      .insert()
      .into(User)
      .values(user)
      .returning("*")
      .execute();

    return this.getById(createdUser.id);
  }

  async update(
    id: number,
    newValues: { email?: string; userName?: string; password?: string }
  ) {
    await this.createQueryBuilder("user")
      .update(User)
      .set(newValues)
      .where("id = :id", { id })
      .execute();

    return this.getById(id);
  }

  delete(user: User) {
    return this.createQueryBuilder("user")
      .delete()
      .from(User)
      .where("id = :id", { id: user.id })
      .execute();
  }

  getById(id: number) {
    return this.select().where("user.id = :id", { id }).getOne();
  }

  getByIdWithAuth(id: number) {
    return this.selectWithAuth().where("user.id = :id", { id }).getOne();
  }

  getByEmail(email: string) {
    return this.select().where("user.email = :email", { email }).getOne();
  }

  getByEmailWithAuth(email: string) {
    return this.selectWithAuth()
      .where("user.email = :email", { email })
      .getOne();
  }
}

export default getCustomRepository(UserRepository);
