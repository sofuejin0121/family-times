import "./MemberSidebar.scss";
import useUsers from "../../hooks/useUsers";
import useGetId from "../../hooks/useGetId";

const MemberSidebar = () => {
  const { documents: users } = useUsers();
  const { documents: getUserIds } = useGetId();
  const uniqueIds = Array.from(new Set(getUserIds.map((doc) => doc.user.uid)));

  return (
    <div className="memberList">
      <div className="memberListHeader">
        <h3>メンバーリスト</h3>
      </div>

      {users
        .filter((user) => uniqueIds.includes(user.uid))
        .map((user) => (
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
