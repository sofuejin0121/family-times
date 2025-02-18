import "./MemberSidebar.scss";
import useUsers from "../../hooks/useUsers";

const MemberSidebar = () => {
  const { documents: users } = useUsers();

  return (
    <div className="memberList">
      <div className="memberListHeader">
        <h3>メンバーリスト -</h3>
      </div>
      {users.map((user) => (
        <div className="memberAccount">
          <img src={user.photoURL} />
          <div className="memberName">
            <h4>{user.displayName}</h4>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemberSidebar;
